CREATE TABLE IF NOT EXISTS "plaid_item" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plaid_item_id" text NOT NULL,
	"access_token" text NOT NULL,
	"institution_id" text,
	"institution_name" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_webhook_code" text,
	"error_type" text,
	"error_code" text,
	"error_message" text,
	"transactions_cursor" text,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plaid_item_plaid_item_id_unique" UNIQUE("plaid_item_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"financial_account_id" text NOT NULL,
	"plaid_transaction_id" text NOT NULL,
	"merchant_name" text,
	"merchant_descriptor" text,
	"amount_cents" integer NOT NULL,
	"currency_code" text,
	"pending" boolean DEFAULT false NOT NULL,
	"category_primary" text,
	"authorized_date" timestamp,
	"posted_at" timestamp,
	"raw_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_plaid_transaction_id_unique" UNIQUE("plaid_transaction_id")
);
--> statement-breakpoint
ALTER TABLE "financial_account" ADD COLUMN IF NOT EXISTS "account_subtype" text;
--> statement-breakpoint
ALTER TABLE "financial_account" ADD COLUMN IF NOT EXISTS "account_name" text;
--> statement-breakpoint
ALTER TABLE "financial_account" ADD COLUMN IF NOT EXISTS "plaid_item_id" text;
--> statement-breakpoint
ALTER TABLE "financial_account" ADD COLUMN IF NOT EXISTS "currency_code" text;
--> statement-breakpoint
ALTER TABLE "financial_account" ADD COLUMN IF NOT EXISTS "last_refreshed_at" timestamp;
--> statement-breakpoint
ALTER TABLE "financial_account" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plaid_item" ADD CONSTRAINT "plaid_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_account" ADD CONSTRAINT "financial_account_plaid_item_id_plaid_item_plaid_item_id_fk" FOREIGN KEY ("plaid_item_id") REFERENCES "public"."plaid_item"("plaid_item_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction" ADD CONSTRAINT "transaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction" ADD CONSTRAINT "transaction_financial_account_id_financial_account_id_fk" FOREIGN KEY ("financial_account_id") REFERENCES "public"."financial_account"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "plaid_item_plaid_item_id_uidx" ON "plaid_item" USING btree ("plaid_item_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plaid_item_user_item_idx" ON "plaid_item" USING btree ("user_id","plaid_item_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "financial_account_provider_account_id_uidx" ON "financial_account" USING btree ("provider_account_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transaction_plaid_transaction_id_uidx" ON "transaction" USING btree ("plaid_transaction_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transaction_user_posted_idx" ON "transaction" USING btree ("user_id","posted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transaction_account_posted_idx" ON "transaction" USING btree ("financial_account_id","posted_at");
