import { and, eq, inArray, or } from "drizzle-orm";
import { Transaction } from "plaid";
import { db } from "@/db/client";
import { financialAccounts, plaidItems, transactions } from "@/db/schema";
import { getPlaidClient } from "@/lib/plaid/client";

type LinkAccountParams = {
  userId: string;
  publicToken: string;
  institutionName?: string;
};

type SyncResult = {
  plaidItemId: string;
  accountsUpserted: number;
  transactionsUpserted: number;
  transactionsRemoved: number;
  status: "active" | "reconnect_required" | "error";
  errorCode?: string;
};

function getPlaidDate(isoDate?: string | null): Date | null {
  if (!isoDate) return null;
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function mapPlaidError(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const maybeError = error as {
    response?: {
      data?: {
        error_code?: unknown;
        error_type?: unknown;
        error_message?: unknown;
      };
    };
  };
  const responseData = maybeError.response?.data;
  const errorCode =
    typeof responseData?.error_code === "string" ? responseData.error_code : "unknown";
  const errorType =
    typeof responseData?.error_type === "string" ? responseData.error_type : "API_ERROR";
  const errorMessage =
    typeof responseData?.error_message === "string"
      ? responseData.error_message
      : "Plaid API request failed";

  return {
    errorCode,
    errorType,
    errorMessage,
    requiresReauth: errorCode === "ITEM_LOGIN_REQUIRED" || errorCode === "INVALID_LINK_TOKEN",
  };
}

async function upsertItemErrorState(params: {
  plaidItemId: string;
  errorCode: string;
  errorType: string;
  errorMessage: string;
  requiresReauth: boolean;
}) {
  await db
    .update(plaidItems)
    .set({
      status: params.requiresReauth ? "reconnect_required" : "error",
      errorCode: params.errorCode,
      errorType: params.errorType,
      errorMessage: params.errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(plaidItems.plaidItemId, params.plaidItemId));
}

export async function syncTransactionsForPlaidItem(params: {
  plaidItemId: string;
  accessToken: string;
  userId: string;
  initialCursor?: string | null;
}): Promise<SyncResult> {
  const plaidClient = getPlaidClient();

  let cursor = params.initialCursor ?? null;
  let hasMore = true;

  const added: Transaction[] = [];
  const modified: Transaction[] = [];
  const removedTransactionIds: string[] = [];

  try {
    while (hasMore) {
      const syncResponse = await plaidClient.transactionsSync({
        access_token: params.accessToken,
        cursor: cursor ?? undefined,
        count: 250,
      });

      added.push(...syncResponse.data.added);
      modified.push(...syncResponse.data.modified);
      removedTransactionIds.push(
        ...syncResponse.data.removed
          .map((entry) => entry.transaction_id)
          .filter((id): id is string => Boolean(id)),
      );
      cursor = syncResponse.data.next_cursor;
      hasMore = syncResponse.data.has_more;
    }

    const sourceTransactions = [...added, ...modified];
    const plaidAccountIds = [...new Set(sourceTransactions.map((txn) => txn.account_id))];
    const accountRows = plaidAccountIds.length
      ? await db
          .select({
            id: financialAccounts.id,
            providerAccountId: financialAccounts.providerAccountId,
          })
          .from(financialAccounts)
          .where(
            and(
              eq(financialAccounts.userId, params.userId),
              inArray(financialAccounts.providerAccountId, plaidAccountIds),
            ),
          )
      : [];

    const accountIdByPlaidAccountId = new Map(
      accountRows.map((row) => [row.providerAccountId, row.id]),
    );

    let transactionsUpserted = 0;
    for (const plaidTransaction of sourceTransactions) {
      const financialAccountId = accountIdByPlaidAccountId.get(plaidTransaction.account_id);
      if (!financialAccountId) continue;

      await db
        .insert(transactions)
        .values({
          userId: params.userId,
          financialAccountId,
          plaidTransactionId: plaidTransaction.transaction_id,
          merchantName: plaidTransaction.merchant_name ?? null,
          merchantDescriptor: plaidTransaction.name ?? null,
          amountCents: toCents(plaidTransaction.amount),
          currencyCode: plaidTransaction.iso_currency_code ?? null,
          pending: Boolean(plaidTransaction.pending),
          categoryPrimary: plaidTransaction.personal_finance_category?.primary ?? null,
          authorizedDate: getPlaidDate(plaidTransaction.authorized_date),
          postedAt: getPlaidDate(plaidTransaction.date),
          rawJson: JSON.stringify(plaidTransaction),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: transactions.plaidTransactionId,
          set: {
            financialAccountId,
            merchantName: plaidTransaction.merchant_name ?? null,
            merchantDescriptor: plaidTransaction.name ?? null,
            amountCents: toCents(plaidTransaction.amount),
            currencyCode: plaidTransaction.iso_currency_code ?? null,
            pending: Boolean(plaidTransaction.pending),
            categoryPrimary: plaidTransaction.personal_finance_category?.primary ?? null,
            authorizedDate: getPlaidDate(plaidTransaction.authorized_date),
            postedAt: getPlaidDate(plaidTransaction.date),
            rawJson: JSON.stringify(plaidTransaction),
            updatedAt: new Date(),
          },
        });

      transactionsUpserted += 1;
    }

    let transactionsRemoved = 0;
    if (removedTransactionIds.length) {
      const deleted = await db
        .delete(transactions)
        .where(
          and(
            eq(transactions.userId, params.userId),
            inArray(transactions.plaidTransactionId, removedTransactionIds),
          ),
        )
        .returning({ id: transactions.id });

      transactionsRemoved = deleted.length;
    }

    await db
      .update(financialAccounts)
      .set({
        lastRefreshedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(financialAccounts.userId, params.userId),
          eq(financialAccounts.plaidItemId, params.plaidItemId),
        ),
      );

    await db
      .update(plaidItems)
      .set({
        status: "active",
        transactionsCursor: cursor,
        lastSyncedAt: new Date(),
        errorCode: null,
        errorType: null,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(plaidItems.plaidItemId, params.plaidItemId));

    return {
      plaidItemId: params.plaidItemId,
      accountsUpserted: accountRows.length,
      transactionsUpserted,
      transactionsRemoved,
      status: "active",
    };
  } catch (error) {
    const plaidError = mapPlaidError(error);
    if (!plaidError) throw error;

    await upsertItemErrorState({
      plaidItemId: params.plaidItemId,
      errorCode: plaidError.errorCode,
      errorType: plaidError.errorType,
      errorMessage: plaidError.errorMessage,
      requiresReauth: plaidError.requiresReauth,
    });

    return {
      plaidItemId: params.plaidItemId,
      accountsUpserted: 0,
      transactionsUpserted: 0,
      transactionsRemoved: 0,
      status: plaidError.requiresReauth ? "reconnect_required" : "error",
      errorCode: plaidError.errorCode,
    };
  }
}

export async function linkPlaidItemAndImportTransactions(
  params: LinkAccountParams,
): Promise<SyncResult> {
  const plaidClient = getPlaidClient();

  const exchangeResponse = await plaidClient.itemPublicTokenExchange({
    public_token: params.publicToken,
  });

  const accessToken = exchangeResponse.data.access_token;
  const plaidItemId = exchangeResponse.data.item_id;

  const [itemResponse, accountsResponse] = await Promise.all([
    plaidClient.itemGet({ access_token: accessToken }),
    plaidClient.accountsGet({ access_token: accessToken }),
  ]);

  const institutionName =
    params.institutionName?.trim() ||
    accountsResponse.data.item?.institution_id ||
    itemResponse.data.item.institution_id ||
    null;

  await db
    .insert(plaidItems)
    .values({
      userId: params.userId,
      plaidItemId,
      accessToken,
      institutionId: itemResponse.data.item.institution_id ?? null,
      institutionName,
      status: "active",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: plaidItems.plaidItemId,
      set: {
        userId: params.userId,
        accessToken,
        institutionId: itemResponse.data.item.institution_id ?? null,
        institutionName,
        status: "active",
        errorCode: null,
        errorType: null,
        errorMessage: null,
        updatedAt: new Date(),
      },
    });

  const now = new Date();
  for (const account of accountsResponse.data.accounts) {
    await db
      .insert(financialAccounts)
      .values({
        userId: params.userId,
        providerAccountId: account.account_id,
        institutionName,
        accountType: account.type,
        accountSubtype: account.subtype ?? null,
        accountName: account.name,
        accountMask: account.mask ?? null,
        plaidItemId,
        currencyCode: account.balances.iso_currency_code ?? null,
        status: "active",
        lastRefreshedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: financialAccounts.providerAccountId,
        set: {
          userId: params.userId,
          institutionName,
          accountType: account.type,
          accountSubtype: account.subtype ?? null,
          accountName: account.name,
          accountMask: account.mask ?? null,
          plaidItemId,
          currencyCode: account.balances.iso_currency_code ?? null,
          status: "active",
          lastRefreshedAt: now,
          updatedAt: now,
        },
      });
  }

  const existingItem = await db
    .select({ cursor: plaidItems.transactionsCursor })
    .from(plaidItems)
    .where(and(eq(plaidItems.userId, params.userId), eq(plaidItems.plaidItemId, plaidItemId)))
    .limit(1);

  const syncResult = await syncTransactionsForPlaidItem({
    userId: params.userId,
    plaidItemId,
    accessToken,
    initialCursor: existingItem[0]?.cursor ?? null,
  });

  return {
    ...syncResult,
    accountsUpserted: accountsResponse.data.accounts.length,
  };
}

export async function refreshPlaidItemsForUser(userId: string) {
  const userItems = await db
    .select({
      plaidItemId: plaidItems.plaidItemId,
      accessToken: plaidItems.accessToken,
      cursor: plaidItems.transactionsCursor,
      status: plaidItems.status,
    })
    .from(plaidItems)
    .where(
      and(
        eq(plaidItems.userId, userId),
        or(
          eq(plaidItems.status, "active"),
          eq(plaidItems.status, "reconnect_required"),
          eq(plaidItems.status, "error"),
        ),
      ),
    );

  const results: SyncResult[] = [];
  for (const item of userItems) {
    const result = await syncTransactionsForPlaidItem({
      userId,
      plaidItemId: item.plaidItemId,
      accessToken: item.accessToken,
      initialCursor: item.cursor,
    });
    results.push(result);
  }

  return results;
}

export async function refreshAllPlaidItems() {
  const rows = await db
    .select({
      userId: plaidItems.userId,
      plaidItemId: plaidItems.plaidItemId,
      accessToken: plaidItems.accessToken,
      cursor: plaidItems.transactionsCursor,
      status: plaidItems.status,
    })
    .from(plaidItems)
    .where(
      or(
        eq(plaidItems.status, "active"),
        eq(plaidItems.status, "error"),
        eq(plaidItems.status, "reconnect_required"),
      ),
    );

  const results: SyncResult[] = [];
  for (const row of rows) {
    const result = await syncTransactionsForPlaidItem({
      userId: row.userId,
      plaidItemId: row.plaidItemId,
      accessToken: row.accessToken,
      initialCursor: row.cursor,
    });
    results.push(result);
  }

  return results;
}

export async function markPlaidItemReauthRequired(params: {
  plaidItemId: string;
  webhookCode?: string | null;
  errorCode?: string | null;
  errorType?: string | null;
  errorMessage?: string | null;
}) {
  await db
    .update(plaidItems)
    .set({
      status: "reconnect_required",
      lastWebhookCode: params.webhookCode ?? null,
      errorCode: params.errorCode ?? "ITEM_LOGIN_REQUIRED",
      errorType: params.errorType ?? "ITEM_ERROR",
      errorMessage:
        params.errorMessage ?? "Plaid requires the user to re-authenticate this institution.",
      updatedAt: new Date(),
    })
    .where(eq(plaidItems.plaidItemId, params.plaidItemId));
}
