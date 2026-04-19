import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// Auth.js Drizzle adapter tables.
// Shape per https://authjs.dev/getting-started/adapters/drizzle
export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  authProvider: text("auth_provider").default("credentials").notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({ columns: [account.provider, account.providerAccountId] }),
  }),
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

// Product-domain tables (sketch only — real shape lands in follow-up tickets).
// Kept minimal so migrations exist end-to-end for CI smoke.
export const financialAccounts = pgTable(
  "financial_account",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("provider_account_id").notNull(),
    institutionName: text("institution_name"),
    accountType: text("account_type"),
    accountSubtype: text("account_subtype"),
    accountName: text("account_name"),
    accountMask: text("account_mask"),
    plaidItemId: text("plaid_item_id"),
    currencyCode: text("currency_code"),
    status: text("status").default("active").notNull(),
    lastRefreshedAt: timestamp("last_refreshed_at", { mode: "date" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    providerAccountIdUniqueIdx: uniqueIndex("financial_account_provider_account_id_uidx").on(
      table.providerAccountId,
    ),
  }),
);

export const plaidItems = pgTable(
  "plaid_item",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plaidItemId: text("plaid_item_id").notNull(),
    accessToken: text("access_token").notNull(),
    institutionId: text("institution_id"),
    institutionName: text("institution_name"),
    status: text("status").default("active").notNull(),
    lastWebhookCode: text("last_webhook_code"),
    errorType: text("error_type"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    transactionsCursor: text("transactions_cursor"),
    lastSyncedAt: timestamp("last_synced_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    plaidItemIdUniqueIdx: uniqueIndex("plaid_item_plaid_item_id_uidx").on(table.plaidItemId),
    userItemIdx: index("plaid_item_user_item_idx").on(table.userId, table.plaidItemId),
  }),
);

export const transactions = pgTable(
  "transaction",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    financialAccountId: text("financial_account_id")
      .notNull()
      .references(() => financialAccounts.id, { onDelete: "cascade" }),
    plaidTransactionId: text("plaid_transaction_id").notNull(),
    merchantName: text("merchant_name"),
    merchantDescriptor: text("merchant_descriptor"),
    amountCents: integer("amount_cents").notNull(),
    currencyCode: text("currency_code"),
    pending: boolean("pending").default(false).notNull(),
    categoryPrimary: text("category_primary"),
    authorizedDate: timestamp("authorized_date", { mode: "date" }),
    postedAt: timestamp("posted_at", { mode: "date" }),
    rawJson: text("raw_json"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    plaidTransactionUniqueIdx: uniqueIndex("transaction_plaid_transaction_id_uidx").on(
      table.plaidTransactionId,
    ),
    userPostedIdx: index("transaction_user_posted_idx").on(table.userId, table.postedAt),
    accountPostedIdx: index("transaction_account_posted_idx").on(
      table.financialAccountId,
      table.postedAt,
    ),
  }),
);

export const subscriptionCandidates = pgTable("subscription_candidate", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  merchantNormalized: text("merchant_normalized").notNull(),
  displayName: text("display_name"),
  estimatedAmountCents: integer("estimated_amount_cents"),
  cadence: text("cadence"),
  confidenceBand: text("confidence_band"),
  isActive: boolean("is_active").default(true).notNull(),
  firstSeenAt: timestamp("first_seen_at"),
  lastSeenAt: timestamp("last_seen_at"),
  occurrenceCount: integer("occurrence_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const validationDecisions = pgTable(
  "validation_decision",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subscriptionCandidateId: text("subscription_candidate_id").references(
      () => subscriptionCandidates.id,
      {
        onDelete: "set null",
      },
    ),
    cardId: text("card_id").notNull(),
    merchant: text("merchant").notNull(),
    decisionId: text("decision_id").notNull(),
    amountCents: integer("amount_cents"),
    cadence: text("cadence"),
    mergeIntoCardId: text("merge_into_card_id"),
    decidedAt: timestamp("decided_at", { mode: "date" }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userDecidedIdx: index("validation_decision_user_decided_idx").on(table.userId, table.decidedAt),
  }),
);

export const reminderDeliveries = pgTable(
  "reminder_delivery",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subscriptionCandidateId: text("subscription_candidate_id").references(
      () => subscriptionCandidates.id,
      {
        onDelete: "set null",
      },
    ),
    idempotencyKey: text("idempotency_key").notNull(),
    channel: text("channel").default("email").notNull(),
    templateId: text("template_id").notNull(),
    recipient: text("recipient").notNull(),
    payloadJson: text("payload_json").notNull(),
    status: text("status").default("pending").notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(5).notNull(),
    scheduledFor: timestamp("scheduled_for", { mode: "date" }).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { mode: "date" }).notNull(),
    lastAttemptAt: timestamp("last_attempt_at", { mode: "date" }),
    sentAt: timestamp("sent_at", { mode: "date" }),
    lastErrorCode: text("last_error_code"),
    lastErrorMessage: text("last_error_message"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    idempotencyKeyIdx: index("reminder_delivery_idempotency_key_idx").on(table.idempotencyKey),
    queuePollIdx: index("reminder_delivery_queue_poll_idx").on(table.status, table.nextAttemptAt),
  }),
);

export const reminderDeliveryAttempts = pgTable(
  "reminder_delivery_attempt",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    reminderDeliveryId: text("reminder_delivery_id")
      .notNull()
      .references(() => reminderDeliveries.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    status: text("status").notNull(),
    providerMessageId: text("provider_message_id"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { mode: "date" }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { mode: "date" }),
  },
  (table) => ({
    deliveryAttemptNumberIdx: index("reminder_delivery_attempt_number_idx").on(
      table.reminderDeliveryId,
      table.attemptNumber,
    ),
  }),
);

export const notificationPreferences = pgTable(
  "notification_preference",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reminderChannel: text("reminder_channel").default("email").notNull(),
    reminderFrequency: text("reminder_frequency").default("weekly").notNull(),
    unsubscribedAt: timestamp("unsubscribed_at", { mode: "date" }),
    unsubscribeReason: text("unsubscribe_reason"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userIdUniqueIdx: uniqueIndex("notification_preference_user_id_uidx").on(table.userId),
    channelFrequencyIdx: index("notification_preference_channel_frequency_idx").on(
      table.reminderChannel,
      table.reminderFrequency,
    ),
  }),
);
